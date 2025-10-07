import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código de status HTTP',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Mensagem de erro ou array de mensagens',
    example: 'Email deve ter um formato válido',
    oneOf: [
      { type: 'string' },
      { type: 'array', items: { type: 'string' } },
    ],
  })
  message: string | string[];

  @ApiProperty({
    description: 'Tipo de erro',
    example: 'Bad Request',
  })
  error?: string;

  @ApiProperty({
    description: 'Timestamp do erro',
    example: '2025-10-07T12:50:04.000Z',
  })
  timestamp?: string;

  @ApiProperty({
    description: 'Caminho da requisição que gerou o erro',
    example: '/auth/login',
  })
  path?: string;
}