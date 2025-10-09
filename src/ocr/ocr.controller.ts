import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { OcrResultDto, OcrUploadDto, OcrOptionsDto } from './dto/ocr.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('ocr')
@Controller('ocr')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('extract-text')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Extrair texto de imagem usando OCR',
    description: 'Faz upload de uma imagem e extrai o texto contido nela usando tecnologia OCR',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Texto extraído com sucesso',
    type: OcrResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Arquivo inválido ou erro no processamento',
  })
  @ApiResponse({
    status: 401,
    description: 'Token de autenticação inválido',
  })
  async extractText(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: OcrUploadDto,
  ): Promise<OcrResultDto> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }

    if (!this.ocrService.validateImageType(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de arquivo não suportado. Use: JPEG, PNG, GIF, BMP, TIFF, WebP',
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        'Arquivo muito grande. Tamanho máximo: 10MB',
      );
    }

    const options: OcrOptionsDto = uploadDto.options || {};

    return await this.ocrService.processImageBuffer(file.buffer, options);
  }
}