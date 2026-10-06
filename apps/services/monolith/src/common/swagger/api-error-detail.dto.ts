import { ApiProperty } from '@nestjs/swagger';
import { ApiErrorDetail } from '../interfaces/api-response.interface';

export class ApiErrorDetailDto implements ApiErrorDetail {
  @ApiProperty({ required: false, example: 'email' })
  field?: string;

  @ApiProperty({ example: 'email must be an email' })
  message: string;
}
