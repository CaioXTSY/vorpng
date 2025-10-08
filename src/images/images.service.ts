import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ImageResponseDto } from './dto/image.dto';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class ImagesService {
  private uploadPath: string;
  private readonly USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36"
  ];

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const uploadDir = this.configService.get<string>('UPLOAD_PATH') || 'uploads';
    this.uploadPath = path.resolve(process.cwd(), uploadDir);
    this.ensureUploadDirectoryExists();
  }

  private ensureUploadDirectoryExists() {
    try {
      if (!fs.existsSync(this.uploadPath)) {
        fs.mkdirSync(this.uploadPath, { recursive: true });
        console.log(`📁 Diretório de uploads criado: ${this.uploadPath}`);
      } else {
        console.log(`📁 Diretório de uploads já existe: ${this.uploadPath}`);
      }
    } catch (error) {
      console.error('Erro ao criar diretório de uploads:', error);
      this.uploadPath = path.resolve(process.cwd(), 'uploads');
      try {
        if (!fs.existsSync(this.uploadPath)) {
          fs.mkdirSync(this.uploadPath, { recursive: true });
          console.log(`📁 Diretório de uploads criado como fallback: ${this.uploadPath}`);
        }
      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
        throw new Error('Não foi possível criar o diretório de uploads');
      }
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    userId: number,
  ): Promise<ImageResponseDto> {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não suportado. Use: JPG, PNG, GIF ou WebP');
    }

    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
    const filePath = path.join(this.uploadPath, uniqueFilename);

    try {
      fs.writeFileSync(filePath, file.buffer);

      const image = await this.prisma.image.create({
        data: {
          filename: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          filePath: filePath,
          userId: userId,
        },
      });

      return this.mapToDto(image);
    } catch (error) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw new BadRequestException('Erro ao fazer upload da imagem');
    }
  }

  async getUserImages(userId: number): Promise<{ images: ImageResponseDto[]; total: number }> {
    const images = await this.prisma.image.findMany({
      where: {
        userId: userId,
        status: 'uploaded',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      images: images.map(image => this.mapToDto(image)),
      total: images.length,
    };
  }

  async getImageByUuid(uuid: string, userId: number): Promise<ImageResponseDto> {
    const image = await this.prisma.image.findUnique({
      where: { uuid },
    });

    if (!image) {
      throw new NotFoundException('Imagem não encontrada');
    }

    if (image.userId !== userId) {
      throw new ForbiddenException('Acesso negado a esta imagem');
    }

    return this.mapToDto(image);
  }

  async downloadImage(uuid: string, userId: number): Promise<{ filePath: string; mimeType: string; filename: string }> {
    const image = await this.prisma.image.findUnique({
      where: { uuid },
    });

    if (!image) {
      throw new NotFoundException('Imagem não encontrada');
    }

    if (image.userId !== userId) {
      throw new ForbiddenException('Acesso negado a esta imagem');
    }

    if (!fs.existsSync(image.filePath)) {
      throw new NotFoundException('Arquivo não encontrado no servidor');
    }

    return {
      filePath: image.filePath,
      mimeType: image.mimeType,
      filename: image.filename,
    };
  }

  async deleteImage(uuid: string, userId: number): Promise<{ message: string }> {
    const image = await this.prisma.image.findUnique({
      where: { uuid },
    });

    if (!image) {
      throw new NotFoundException('Imagem não encontrada');
    }

    if (image.userId !== userId) {
      throw new ForbiddenException('Acesso negado a esta imagem');
    }

    if (fs.existsSync(image.filePath)) {
      fs.unlinkSync(image.filePath);
    }

    await this.prisma.image.update({
      where: { uuid },
      data: { status: 'deleted' },
    });

    return { message: 'Imagem deletada com sucesso' };
  }

  private mapToDto(image: any): ImageResponseDto {
    const siteUrl = this.configService.get<string>('SITE_URL') || 'http://localhost:3030';
    return {
      uuid: image.uuid,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      status: image.status,
      createdAt: image.createdAt,
      downloadUrl: `${siteUrl}/images/${image.uuid}/download`,
    };
  }

  private getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  private async buscarImagemUrl(query: string): Promise<string | null> {
    const searchEngines = [
      {
        name: 'Bing',
        url: `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`,
        selectors: ['a.iusc', '.iusc', '[class*="iusc"]', '.mimg'],
        parser: this.parseBingResults.bind(this)
      },
      {
        name: 'DuckDuckGo',
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`,
        selectors: ['.tile--img__img', '.js-images-link'],
        parser: this.parseDuckDuckGoResults.bind(this)
      }
    ];

    for (const engine of searchEngines) {
      try {
        console.log(`🔍 Tentando ${engine.name}...`);
        const result = await this.trySearchEngine(engine, query);
        if (result) {
          console.log(`✅ URL encontrada via ${engine.name}`);
          return result;
        }
      } catch (error) {
        console.warn(`⚠️ ${engine.name} falhou:`, error.message);
        continue;
      }
    }

    return null;
  }

  private async trySearchEngine(engine: any, query: string): Promise<string | null> {
    const headers = {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
    };

    const response = await axios.get(engine.url, { 
      headers, 
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });

    if (response.status === 200 && response.data) {
      return engine.parser(response.data, engine.selectors);
    }

    return null;
  }

  private parseBingResults(html: string, selectors: string[]): string | null {
    const $ = cheerio.load(html);
    
    for (const selector of selectors) {
      const imageElements = $(selector);
      
      for (let i = 0; i < Math.min(imageElements.length, 5); i++) {
        const element = imageElements.eq(i);
        const mAttribute = element.attr('m');
        
        if (mAttribute) {
          try {
            const mData = JSON.parse(mAttribute);
            if (mData.murl && this.isValidImageUrl(mData.murl)) {
              return mData.murl;
            }
          } catch (parseError) {
            // Fallback: regex
            const match = mAttribute.match(/"murl":"([^"]+)"/);
            if (match && match[1] && this.isValidImageUrl(match[1])) {
              return match[1];
            }
          }
        }
        
        // Fallback: img src
        const imgSrc = element.find('img').attr('src') || element.find('img').attr('data-src');
        if (imgSrc && this.isValidImageUrl(imgSrc)) {
          return imgSrc;
        }
      }
    }
    
    return null;
  }

  private parseDuckDuckGoResults(html: string, selectors: string[]): string | null {
    const $ = cheerio.load(html);
    
    for (const selector of selectors) {
      const elements = $(selector);
      
      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        const element = elements.eq(i);
        const src = element.attr('src') || element.attr('data-src') || element.find('img').attr('src');
        
        if (src && this.isValidImageUrl(src)) {
          return src;
        }
      }
    }
    
    return null;
  }

  private isValidImageUrl(url: string): boolean {
    if (!url || !url.startsWith('http')) return false;
    
    // Filtrar URLs inválidas conhecidas
    const invalidPatterns = [
      'data:image', // Base64 images
      '.svg', // SVGs podem causar problemas
      'logo', // Logos geralmente são pequenos
      'icon', // Ícones
      'avatar', // Avatars
      'blank', // Imagens em branco
      '1x1', // Pixels de tracking
    ];
    
    const lowerUrl = url.toLowerCase();
    if (invalidPatterns.some(pattern => lowerUrl.includes(pattern))) {
      return false;
    }

    // Aceitar apenas domínios confiáveis
    try {
      const urlObj = new URL(url);
      const trustedDomains = [
        'bing.com', 'microsoft.com', 'live.com',
        'imgur.com', 'reddit.com', 'github.com',
        'wikimedia.org', 'wikipedia.org',
        'unsplash.com', 'pexels.com', 'pixabay.com'
      ];
      
      // Se não for de um domínio confiável, ainda aceitar mas com menor prioridade
      return true;
    } catch {
      return false;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async downloadImageWithRetry(imageUrl: string, query: string, maxRetries = 3): Promise<Buffer | { error: string }> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Delay progressivo entre tentativas
        if (attempt > 1) {
          await this.delay(attempt * 1000);
        }

        const headers = {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'cross-site',
          'Referer': 'https://www.bing.com/',
          'Origin': 'https://www.bing.com',
        };

        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 5,
          headers,
          validateStatus: (status) => status < 400, // Aceitar redirecionamentos
        });

        if (response.data) {
          const buffer = Buffer.from(response.data);
          
          // Verificar se é uma imagem válida
          if (buffer.length > 512 && this.isValidImageBuffer(buffer)) {
            return buffer;
          } else {
            console.warn(`Tentativa ${attempt}: Imagem inválida ou muito pequena (${buffer.length} bytes)`);
            continue;
          }
        }
      } catch (error) {
        console.warn(`Tentativa ${attempt} falhou:`, error.message);
        
        if (attempt === maxRetries) {
          // Tentar diferentes estratégias na última tentativa
          return await this.tryAlternativeDownload(imageUrl, query);
        }
      }
    }

    return { error: `Falha ao baixar imagem após ${maxRetries} tentativas para: ${query}` };
  }

  private async tryAlternativeDownload(imageUrl: string, query: string): Promise<Buffer | { error: string }> {
    try {
      // Estratégia alternativa: requisição mais simples
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'curl/7.68.0', // User-agent mais simples
        },
        maxRedirects: 10,
        validateStatus: () => true, // Aceitar qualquer status
      });

      if (response.data && response.data.byteLength > 512) {
        const buffer = Buffer.from(response.data);
        if (this.isValidImageBuffer(buffer)) {
          return buffer;
        }
      }

      return { error: `Nenhuma estratégia funcionou para baixar a imagem: ${query}` };
    } catch (error) {
      return { error: `Todas as estratégias falharam para: ${query}. Último erro: ${error.message}` };
    }
  }

  private isValidImageBuffer(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;

    // Verificar assinaturas de arquivos de imagem
    const signatures = [
      [0xFF, 0xD8], // JPEG
      [0x89, 0x50, 0x4E, 0x47], // PNG
      [0x47, 0x49, 0x46], // GIF
      [0x52, 0x49, 0x46, 0x46], // WebP (RIFF)
      [0x42, 0x4D], // BMP
    ];

    return signatures.some(sig => 
      sig.every((byte, index) => buffer[index] === byte)
    );
  }

  async buscarImagem(query: string): Promise<Buffer | { error: string }> {
    try {
      console.log(`🔍 Buscando imagem para: "${query}"`);
      
      const imagemUrl = await this.buscarImagemUrl(query);
      
      if (!imagemUrl) {
        console.warn(`❌ Nenhuma URL encontrada para: ${query}`);
        return { error: `Nenhuma imagem encontrada para: ${query}` };
      }

      console.log(`🌐 URL encontrada: ${imagemUrl.substring(0, 100)}...`);
      
      return await this.downloadImageWithRetry(imagemUrl, query);
      
    } catch (error) {
      console.error(`💥 Erro geral ao buscar imagem:`, error);
      const errorMessage = `Erro interno ao buscar imagem para: ${query}. Tente novamente em alguns segundos.`;
      const detailedError = process.env.NODE_ENV === 'development' 
        ? `${errorMessage} Detalhes: ${error.message}`
        : errorMessage;
      
      return { error: detailedError };
    }
  }
}