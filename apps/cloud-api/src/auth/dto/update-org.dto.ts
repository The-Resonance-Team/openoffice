import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slug?: string;
}
