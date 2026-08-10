import { IsEnum } from 'class-validator';

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

export class UpdatePreferencesDto {
  @IsEnum(Theme)
  theme: Theme;
}
