import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { RunGapConnectionDto } from '@openathlete/shared';

import { JwtUser, UserTypeGuard } from '../../auth';
import { AuthUser } from '../../auth/decorators/user.decorator';
import { RunGapService } from '../services/rungap.service';

@ApiTags('Activities')
@Controller('activity-import/rungap')
export class RunGapController {
  constructor(private readonly service: RunGapService) {}

  @Get('connection')
  @UseGuards(AuthGuard('jwt'), UserTypeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get your RunGap connection' })
  @Header('Cache-Control', 'no-store')
  connection(@JwtUser() user: AuthUser): Promise<RunGapConnectionDto> {
    return this.service.connection(user);
  }

  @Post('connection')
  @UseGuards(AuthGuard('jwt'), UserTypeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable your RunGap connection' })
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  connect(@JwtUser() user: AuthUser): Promise<RunGapConnectionDto> {
    return this.service.connect(user);
  }

  @Delete('connection')
  @UseGuards(AuthGuard('jwt'), UserTypeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect your RunGap webhook' })
  @HttpCode(204)
  disconnect(@JwtUser() user: AuthUser): Promise<void> {
    return this.service.disconnect(user);
  }

  @Post(':id')
  @SkipThrottle()
  @HttpCode(200)
  @ApiOperation({ summary: 'Import a RunGap workout' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Imported or already present' })
  @ApiResponse({
    status: 400,
    description: 'Invalid workout or multipart data',
  })
  @ApiResponse({ status: 401, description: 'Invalid signature or connection' })
  @ApiResponse({ status: 413, description: 'Upload too large' })
  receive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
    @Headers('content-type') contentType?: string,
    @Headers('x-rungap-hmac-sha256') signature?: string,
  ) {
    return this.service.receive(id, body, contentType, signature);
  }
}
