import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PIPES_METADATA } from '@nestjs/common/constants';
import type { ValidationPipe } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { JoinGameDto } from './dto/join-game.dto';

describe('GameGateway', () => {
  let gameService: { getLobbyState: jest.Mock; recordJoin: jest.Mock };
  let gateway: GameGateway;

  beforeEach(() => {
    gameService = {
      getLobbyState: jest.fn(),
      recordJoin: jest.fn(),
    };
    gateway = new GameGateway(gameService as unknown as GameService);
  });

  it('retrieves the lobby state on connection and emits it to the client', async () => {
    const lobbyState = { id: 'game-123', code: 'TEST' };
    const client: Partial<Socket> = { emit: jest.fn() };
    gameService.getLobbyState.mockResolvedValue(lobbyState);

    await gateway.handleConnection(client as Socket);

    expect(gameService.getLobbyState).toHaveBeenCalledTimes(1);
    expect(client.emit).toHaveBeenCalledWith('lobby:update', lobbyState);
  });

  it('records a join, broadcasts the new state, and resolves with the lobby snapshot', async () => {
    const payload: JoinGameDto = {
      gameCode: 'ABCD',
      player: {
        id: 'player-1',
        name: 'Alice',
        color: '#ff0000',
        role: 'attacker',
      },
    };
    const updatedState = { id: 'game-123', code: 'ABCD', players: [] };
    const callOrder: string[] = [];

    gameService.recordJoin.mockImplementation(async () => {
      callOrder.push('recordJoin');
      return updatedState;
    });

    const emitSpy = jest.fn(() => {
      callOrder.push('emit');
    });

    gateway.server = { emit: emitSpy } as unknown as Server;

    await expect(gateway.joinGame(payload)).resolves.toBe(updatedState);

    expect(gameService.recordJoin).toHaveBeenCalledWith(payload);
    expect(emitSpy).toHaveBeenCalledWith('lobby:update', updatedState);
    expect(callOrder).toEqual(['recordJoin', 'emit']);
  });

  it('rejects invalid join payloads through the configured ValidationPipe', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameGateway,
        {
          provide: GameService,
          useValue: {
            getLobbyState: jest.fn(),
            recordJoin: jest.fn(),
          },
        },
      ],
    }).compile();

    moduleRef.get(GameGateway);

    const pipes =
      (Reflect.getMetadata(
        PIPES_METADATA,
        GameGateway.prototype,
        'joinGame',
      ) as ValidationPipe[] | undefined) ??
      (Reflect.getMetadata(PIPES_METADATA, GameGateway.prototype.joinGame) as
        | ValidationPipe[]
        | undefined);

    expect(pipes).toBeDefined();
    expect(pipes).toHaveLength(1);

    const [validationPipe] = pipes!;

    await expect(
      validationPipe.transform(
        {
          gameCode: 'bad code',
          player: {
            id: '',
            name: '',
            color: 'not-a-color',
            role: 'spy',
          },
        },
        { type: 'body', metatype: JoinGameDto },
      ),
    ).rejects.toThrow();
  });
});
