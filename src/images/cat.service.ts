import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CatImageDto, CatQueryDto } from './dto/cat.dto';

@Injectable()
export class CatService {
  private readonly logger = new Logger(CatService.name);
  private readonly catApiUrl = 'https://api.thecatapi.com/v1/images/search';
  private readonly cataasUrl = 'https://cataas.com/cat';
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'cats');

  constructor(private readonly configService: ConfigService) {
    this.ensureCatsDirectoryExists();
  }

  private ensureCatsDirectoryExists(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      this.logger.log(`📁 Diretório de gatos criado: ${this.uploadsDir}`);
    }
  }

  async getRandomCatImage(query: CatQueryDto = {}): Promise<CatImageDto> {
    try {
      const externalImageUrl = await this.getExternalCatImageUrl(query);
      const localImagePath = await this.downloadAndSaveImage(externalImageUrl);
      const siteUrl = this.configService.get<string>('SITE_URL') || 'http://localhost:3030';
      
      return {
        url: `${siteUrl}/images/cats/${path.basename(localImagePath)}`,
        id: this.generateRandomId(),
        width: this.getDefaultWidth(query.size),
        height: this.getDefaultHeight(query.size),
        localPath: localImagePath,
        filename: path.basename(localImagePath),
      };
    } catch (error) {
      this.logger.error('Erro ao buscar imagem de gato:', error);
      throw new BadRequestException('Não foi possível obter uma imagem de gato');
    }
  }

  private async getExternalCatImageUrl(query: CatQueryDto): Promise<string> {
    try {
      const result = await this.getCatFromApi(query);
      if (result) {
        return result.url;
      }

      return await this.getCatFromCataas(query);
    } catch (error) {
      this.logger.warn('Erro ao obter URL externa, usando fallback');
      return await this.getCatFromCataas(query);
    }
  }

  private async getCatFromCataas(query: CatQueryDto): Promise<string> {
    const sizeParam = this.mapSizeToPixels(query.size);
    return `${this.cataasUrl}${sizeParam}?${Date.now()}`;
  }

  private async downloadAndSaveImage(imageUrl: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'stream',
        timeout: 10000,
        headers: {
          'User-Agent': 'VorPNG-CatService/1.0'
        }
      });

      const fileName = `cat_${Date.now()}_${this.generateRandomId()}.jpg`;
      const filePath = path.join(this.uploadsDir, fileName);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          this.logger.debug(`Imagem de gato salva: ${fileName}`);
          resolve(filePath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      this.logger.error('Erro ao fazer download da imagem:', error);
      throw new BadRequestException('Falha ao baixar imagem de gato');
    }
  }

  private async getCatFromApi(query: CatQueryDto): Promise<{ url: string } | null> {
    try {
      const response = await axios.get(this.catApiUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'VorPNG-CatService/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        const catData = response.data[0];
        return {
          url: catData.url,
        };
      }

      return null;
    } catch (error) {
      this.logger.warn('TheCatAPI não disponível, tentando fonte alternativa');
      return null;
    }
  }

  private mapSizeToPixels(size?: string): string {
    switch (size) {
      case 'small':
        return '/400/300';
      case 'med':
        return '/600/400';
      case 'full':
        return '/800/600';
      default:
        return '/600/400';
    }
  }

  private getDefaultWidth(size?: string): number {
    switch (size) {
      case 'small':
        return 400;
      case 'med':
        return 600;
      case 'full':
        return 800;
      default:
        return 600;
    }
  }

  private getDefaultHeight(size?: string): number {
    switch (size) {
      case 'small':
        return 300;
      case 'med':
        return 400;
      case 'full':
        return 600;
      default:
        return 400;
    }
  }

  private generateRandomId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}