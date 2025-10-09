import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CatImageDto {
  @ApiProperty({
    description: 'URL da imagem do gato',
    example: 'https://cdn2.thecatapi.com/images/abc123.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'ID único da imagem',
    example: 'abc123',
  })
  id: string;

  @ApiProperty({
    description: 'Largura da imagem em pixels',
    example: 1200,
    required: false,
  })
  width?: number;

  @ApiProperty({
    description: 'Altura da imagem em pixels',
    example: 800,
    required: false,
  })
  height?: number;

  localPath?: string;
  filename?: string;
}

export class CatQueryDto {
  @ApiProperty({
    description: 'Tamanho da imagem desejada',
    example: 'med',
    enum: ['small', 'med', 'full'],
    required: false,
  })
  @IsOptional()
  @IsString()
  size?: string = 'med';

  @ApiProperty({
    description: 'Formato da imagem',
    example: 'jpg',
    enum: ['jpg', 'png', 'gif'],
    required: false,
  })
  @IsOptional()
  @IsString()
  format?: string = 'jpg';
}