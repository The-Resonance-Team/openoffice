import { IsBoolean } from 'class-validator';

export class UpdateUpdatesDto {
  @IsBoolean()
  wantsUpdates: boolean;
}
