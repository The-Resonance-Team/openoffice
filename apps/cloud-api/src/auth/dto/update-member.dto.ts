import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '@/generated/client';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
