import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ImageResponseDto } from './dto/image.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImagesService {
  private uploadPath: string;

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
    return {
      uuid: image.uuid,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.size,
      status: image.status,
      createdAt: image.createdAt,
      downloadUrl: `http://localhost:3000/images/${image.uuid}/download`,
    };
  }
}