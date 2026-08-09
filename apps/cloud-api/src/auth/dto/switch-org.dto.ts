import { IsNotEmpty, IsString } from 'class-validator'

export class SwitchOrgDto {
  @IsString()
  @IsNotEmpty()
  memberId: string
}
