import { IsNotEmpty, IsString } from 'class-validator';

export class AssignTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  memberId: string;
}
