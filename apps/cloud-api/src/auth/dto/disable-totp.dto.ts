import { IsString, MinLength } from 'class-validator';

export class DisableTotpDto {
  @IsString()
  @MinLength(8)
  password: string;
}
