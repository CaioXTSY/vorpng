import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNumber, Min, Max } from 'class-validator';

export class OcrResultDto {
  @ApiProperty({
    description: 'Texto extraído da imagem (processado)',
    example: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  })
  text: string;

  @ApiProperty({
    description: 'Texto original extraído (sem processamento)',
    example: 'Lorem ipsum  dolor\nsit amet consectetur\nadipiscing elit',
  })
  originalText: string;

  @ApiProperty({
    description: 'Nível de confiança do OCR (0-100)',
    example: 87.3,
  })
  confidence: number;
}

export class OcrOptionsDto {
  @ApiProperty({
    description: 'Idioma para reconhecimento (padrão: por+eng)',
    example: 'eng',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string = 'por+eng';

  @ApiProperty({
    description: 'Modo de segmentação de página (PSM)',
    example: 6,
    required: false,
    enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(13)
  psm?: number = 6;

  @ApiProperty({
    description: 'Modo de engine OCR (OEM)',
    example: 3,
    required: false,
    enum: [0, 1, 2, 3],
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(3)
  oem?: number = 3;
}

export class OcrUploadDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Arquivo de imagem para OCR (PNG, JPEG, GIF, BMP, TIFF, WebP)',
  })
  image: any;

  @ApiProperty({
    description: 'Opções de OCR',
    type: OcrOptionsDto,
    required: false,
  })
  @IsOptional()
  options?: OcrOptionsDto;
}