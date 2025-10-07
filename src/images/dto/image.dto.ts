import { ApiProperty } from '@nestjs/swagger';

export class ImageResponseDto {
  @ApiProperty({
    description: 'UUID único da imagem',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  uuid: string;

  @ApiProperty({
    description: 'Nome original do arquivo',
    example: 'minha-foto.jpg',
  })
  filename: string;

  @ApiProperty({
    description: 'Tipo MIME da imagem',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: 'Tamanho do arquivo em bytes',
    example: 2048576,
  })
  size: number;

  @ApiProperty({
    description: 'Status do arquivo',
    example: 'uploaded',
    enum: ['uploaded', 'processing', 'error', 'deleted'],
  })
  status: string;

  @ApiProperty({
    description: 'Data de upload',
    example: '2025-10-07T12:50:04.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'URL para download da imagem',
    example: 'http://localhost:3000/images/f47ac10b-58cc-4372-a567-0e02b2c3d479/download',
  })
  downloadUrl?: string;
}

export class UploadResponseDto {
  @ApiProperty({
    description: 'Mensagem de sucesso',
    example: 'Imagem enviada com sucesso',
  })
  message: string;

  @ApiProperty({
    description: 'Dados da imagem enviada',
    type: ImageResponseDto,
  })
  image: ImageResponseDto;
}

export class ImageListDto {
  @ApiProperty({
    description: 'Lista de imagens do usuário',
    type: [ImageResponseDto],
  })
  images: ImageResponseDto[];

  @ApiProperty({
    description: 'Total de imagens',
    example: 15,
  })
  total: number;
}