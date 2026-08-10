import { IsBoolean } from 'class-validator';

export class UpdateNotificationsDto {
  @IsBoolean()
  inviteEmail: boolean;

  @IsBoolean()
  passwordChangeEmail: boolean;

  @IsBoolean()
  memberJoinEmail: boolean;
}
