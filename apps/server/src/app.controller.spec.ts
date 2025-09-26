import { Test, TestingModule } from '@nestjs/testing';
import { createInitialGameState } from '@netrisk/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameService } from './game/game.service';

describe('AppController', () => {
  let appController: AppController;
  const lobby = createInitialGameState('TEST');

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: GameService,
          useValue: {
            getLobbyState: jest.fn().mockResolvedValue(lobby),
          },
        },
      ],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  it('returns a health payload that includes lobby metadata', async () => {
    await expect(appController.getHealth()).resolves.toEqual({
      status: 'ok',
      lobby,
    });
  });
});
