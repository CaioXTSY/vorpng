import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('vorpng')
    .setDescription('vorp api to images')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Endpoints de autenticação')
    .addTag('profile', 'Endpoints do perfil do usuário')
    .addTag('images', 'Endpoints de upload, gerenciamento de imagens e gatos aleatórios')
    .addTag('ocr', 'Endpoints de OCR')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(3030);
  console.log('🚀 Servidor rodando em http://localhost:3030');
  console.log('📚 Documentação Swagger disponível em http://localhost:3030');
}
bootstrap();