import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImagesService } from './images.service';
import { ImageResponseDto, UploadResponseDto, ImageListDto } from './dto/image.dto';
import * as fs from 'fs';

@ApiTags('images')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Fazer upload de uma imagem',
    description: 'Envia uma imagem para o servidor. Apenas o usuário autenticado terá acesso à imagem.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Arquivo de imagem para upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de imagem (JPG, PNG, GIF, WebP)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Imagem enviada com sucesso',
    type: UploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Arquivo inválido ou tipo não suportado',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido ou ausente',
  })
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ): Promise<UploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    const image = await this.imagesService.uploadImage(file, req.user.id);

    return {
      message: 'Imagem enviada com sucesso',
      image,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Listar imagens do usuário',
    description: 'Retorna todas as imagens do usuário autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de imagens do usuário',
    type: ImageListDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido ou ausente',
  })
  async getUserImages(@Request() req): Promise<ImageListDto> {
    return await this.imagesService.getUserImages(req.user.id);
  }

  @Get(':uuid')
  @ApiOperation({
    summary: 'Obter detalhes de uma imagem',
    description: 'Retorna os metadados de uma imagem específica (apenas se pertencer ao usuário)',
  })
  @ApiParam({
    name: 'uuid',
    description: 'UUID único da imagem',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhes da imagem',
    type: ImageResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado - imagem não pertence ao usuário',
  })
  @ApiResponse({
    status: 404,
    description: 'Imagem não encontrada',
  })
  async getImage(@Param('uuid') uuid: string, @Request() req): Promise<ImageResponseDto> {
    return await this.imagesService.getImageByUuid(uuid, req.user.id);
  }

  @Get(':uuid/download')
  @ApiOperation({
    summary: 'Fazer download de uma imagem',
    description: 'Baixa o arquivo da imagem (apenas se pertencer ao usuário)',
  })
  @ApiParam({
    name: 'uuid',
    description: 'UUID único da imagem',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Arquivo da imagem',
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
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado - imagem não pertence ao usuário',
  })
  @ApiResponse({
    status: 404,
    description: 'Imagem ou arquivo não encontrado',
  })
  async downloadImage(
    @Param('uuid') uuid: string,
    @Request() req,
    @Res() res: Response,
  ): Promise<void> {
    const { filePath, mimeType, filename } = await this.imagesService.downloadImage(uuid, req.user.id);
    
    const fileStream = fs.createReadStream(filePath);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    fileStream.pipe(res);
  }

  @Delete(':uuid')
  @ApiOperation({
    summary: 'Deletar uma imagem',
    description: 'Remove uma imagem do servidor (apenas se pertencer ao usuário)',
  })
  @ApiParam({
    name: 'uuid',
    description: 'UUID único da imagem',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: 200,
    description: 'Imagem deletada com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Imagem deletada com sucesso',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Acesso negado - imagem não pertence ao usuário',
  })
  @ApiResponse({
    status: 404,
    description: 'Imagem não encontrada',
  })
  async deleteImage(@Param('uuid') uuid: string, @Request() req) {
    return await this.imagesService.deleteImage(uuid, req.user.id);
  }
}