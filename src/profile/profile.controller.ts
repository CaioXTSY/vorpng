import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserResponseDto } from '../auth/dto/auth.dto';

class ProfileResponse {
  message: string;
  user: UserResponseDto;
}

@ApiTags('profile')
@ApiBearerAuth('JWT-auth')
@Controller('profile')
export class ProfileController {
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Obter perfil do usuário',
    description: 'Retorna as informações do perfil do usuário autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil do usuário obtido com sucesso',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'This is a protected route',
        },
        user: {
          $ref: '#/components/schemas/UserResponseDto',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT inválido ou ausente',
  })
  getProfile(@Request() req): ProfileResponse {
    return {
      message: 'This is a protected route',
      user: req.user,
    };
  }
}