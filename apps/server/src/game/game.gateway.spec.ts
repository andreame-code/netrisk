import { ValidationPipe } from '@nestjs/common';
import { PIPES_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { Socket } from 'socket.io';
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

  it('emits the latest lobby state when a client connects', async () => {
    const client = { emit: jest.fn() } as unknown as Socket;
    const lobbyState = { id: 'game-001', players: [] };
    gameService.getLobbyState.mockResolvedValueOnce(lobbyState);

    await gateway.handleConnection(client);

    expect(gameService.getLobbyState).toHaveBeenCalledTimes(1);
    expect(client.emit).toHaveBeenCalledWith('lobby:update', lobbyState);
  });

  it('awaits join processing before broadcasting and returns the lobby state', async () => {
    const payload = {
      gameCode: 'ABCD',
      player: {
        id: 'player-123',
        name: 'Charlie',
        color: '#112233',
        role: 'attacker',
      },
    } as JoinGameDto;

    const lobbyState = { id: 'game-002', players: [{ id: 'player-123' }] };
    let resolveJoin: ((state: typeof lobbyState) => void) | undefined;
    const joinResult = new Promise<typeof lobbyState>((resolve) => {
      resolveJoin = resolve;
    });

    gameService.recordJoin.mockReturnValue(joinResult);

    const server = { emit: jest.fn() };
    gateway.server = server as unknown as GameGateway['server'];

    const joinPromise = gateway.joinGame(payload);

    expect(gameService.recordJoin).toHaveBeenCalledWith(payload);
    expect(server.emit).not.toHaveBeenCalled();

    resolveJoin?.(lobbyState);

    await expect(joinPromise).resolves.toBe(lobbyState);
    expect(server.emit).toHaveBeenCalledWith('lobby:update', lobbyState);
  });

  it('rejects invalid join payloads through the configured ValidationPipe', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GameGateway,
        {
          provide: GameService,
          useValue: gameService,
        },
      ],
    }).compile();

    const moduleGateway = moduleRef.get(GameGateway);
    expect(moduleGateway).toBeInstanceOf(GameGateway);

    const pipes = (Reflect.getMetadata(
      PIPES_METADATA,
      GameGateway.prototype,
      'joinGame',
    ) || []) as ValidationPipe[];

    expect(pipes).not.toHaveLength(0);

    const [validationPipe] = pipes;
    expect(validationPipe).toBeInstanceOf(ValidationPipe);
    const invalidPayload = {
      gameCode: 'abcd',
      player: {
        id: '',
        name: '',
        color: 'not-a-color',
        role: 'spy',
      },
    };

    await expect(
      validationPipe.transform(invalidPayload, {
        type: 'body',
        metatype: JoinGameDto,
      } as any),
    ).rejects.toThrow();

    await moduleRef.close();
  });
});
