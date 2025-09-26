import { Type } from 'class-transformer';
import {
  IsHexColor,
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import type { JoinGameRequest, PlayerRole } from '@netrisk/core';

class PlayerProfileDto implements JoinGameRequest['player'] {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @Length(1, 50)
  name!: string;

  @IsHexColor()
  color!: string;

  @IsIn(['attacker', 'defender', 'observer'])
  role!: PlayerRole;
}

export class JoinGameDto implements JoinGameRequest {
  @IsString()
  @Matches(/^[A-Z0-9]+$/)
  @Length(4, 12)
  gameCode!: string;

  @ValidateNested()
  @Type(() => PlayerProfileDto)
  player!: PlayerProfileDto;
}
