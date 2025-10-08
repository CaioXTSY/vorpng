import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ImagesService } from './images.service';

@ApiTags('web-search')
@Controller('web-search')
export class WebSearchController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get('images')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests por minuto
  @ApiOperation({
    summary: 'Buscar imagem na web',
    description: 'Busca e retorna a primeira imagem encontrada na web baseado no termo de busca fornecido usando o Bing Image Search. Limitado a 5 requests por minuto.',
  })
  @ApiQuery({
    name: 'q',
    description: 'Termo de busca para encontrar imagens',
    example: 'gato fofo',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Imagem encontrada e retornada',
    content: {
      'image/jpeg': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
      'image/png': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
      'image/gif': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
      'image/webp': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Erro ao buscar ou baixar a imagem',
    schema: {
      type: 'object',
      properties: {
        error: {
          type: 'string',
          example: 'Nenhuma imagem encontrada para: gato fofo',
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit excedido - muitas requisições',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'ThrottlerException: Too Many Requests',
        },
      },
    },
  })
  async buscarImagem(
    @Query('q') query: string,
    @Res() res: Response,
  ) {
    try {
      // Validações de entrada
      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          error: 'Parâmetro "q" é obrigatório e não pode estar vazio',
          code: 'MISSING_QUERY'
        });
      }

      const cleanQuery = query.trim();

      if (cleanQuery.length > 100) {
        return res.status(400).json({
          error: 'Termo de busca muito longo (máximo 100 caracteres)',
          code: 'QUERY_TOO_LONG'
        });
      }

      // Filtrar queries potencialmente problemáticas
      const forbiddenTerms = ['explicit', 'nsfw', 'adult'];
      if (forbiddenTerms.some(term => cleanQuery.toLowerCase().includes(term))) {
        return res.status(400).json({
          error: 'Termo de busca não permitido',
          code: 'FORBIDDEN_QUERY'
        });
      }

      console.log(`🔍 Nova busca: "${cleanQuery}"`);
      
      const resultado = await this.imagesService.buscarImagem(cleanQuery);

      if (Buffer.isBuffer(resultado)) {
        // Detectar tipo de conteúdo da imagem
        const contentType = this.detectImageContentType(resultado);
        const fileExtension = this.getFileExtension(contentType);
        
        console.log(`✅ Imagem encontrada: ${resultado.length} bytes, tipo: ${contentType}`);
        
        res.set({
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(cleanQuery)}.${fileExtension}"`,
          'Cache-Control': 'public, max-age=3600',
          'X-Image-Size': resultado.length.toString(),
          'X-Content-Type-Detected': contentType,
        });
        
        return res.send(resultado);
      } else {
        console.warn(`❌ Falha na busca: ${resultado.error}`);
        
        // Classificar tipos de erro para retornar status codes apropriados
        let statusCode = 404;
        let errorCode = 'IMAGE_NOT_FOUND';
        
        if (resultado.error.includes('timeout') || resultado.error.includes('ECONNRESET')) {
          statusCode = 503;
          errorCode = 'SERVICE_TIMEOUT';
        } else if (resultado.error.includes('403') || resultado.error.includes('forbidden')) {
          statusCode = 502;
          errorCode = 'ACCESS_BLOCKED';
        } else if (resultado.error.includes('500') || resultado.error.includes('502')) {
          statusCode = 502;
          errorCode = 'UPSTREAM_ERROR';
        }
        
        return res.status(statusCode).json({
          error: resultado.error,
          code: errorCode,
          query: cleanQuery,
          suggestion: statusCode === 503 
            ? 'Tente novamente em alguns segundos' 
            : 'Tente usar termos de busca diferentes'
        });
      }
    } catch (error) {
      console.error(`💥 Erro no controller:`, error);
      
      return res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Tente novamente mais tarde'
      });
    }
  }

  private detectImageContentType(buffer: Buffer): string {
    // Verificar assinatura dos bytes para detectar tipo de imagem
    if (buffer.length < 4) return 'image/jpeg';

    const signature = buffer.subarray(0, 4);
    
    // JPEG
    if (signature[0] === 0xFF && signature[1] === 0xD8) {
      return 'image/jpeg';
    }
    
    // PNG
    if (signature[0] === 0x89 && signature[1] === 0x50 && 
        signature[2] === 0x4E && signature[3] === 0x47) {
      return 'image/png';
    }
    
    // GIF
    if (signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46) {
      return 'image/gif';
    }
    
    // WebP
    if (buffer.length >= 12 && 
        signature[0] === 0x52 && signature[1] === 0x49 && 
        signature[2] === 0x46 && signature[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && 
        buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }
    
    // Default para JPEG
    return 'image/jpeg';
  }

  private getFileExtension(contentType: string): string {
    switch (contentType) {
      case 'image/png': return 'png';
      case 'image/gif': return 'gif';
      case 'image/webp': return 'webp';
      default: return 'jpg';
    }
  }
}