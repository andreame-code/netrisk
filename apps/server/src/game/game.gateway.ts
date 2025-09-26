import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UsePipes, ValidationPipe } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JoinGameDto } from './dto/join-game.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly gameService: GameService) {}

  async handleConnection(client: Socket) {
    const lobby = await this.gameService.getLobbyState();
    client.emit('lobby:update', lobby);
  }

  handleDisconnect() {
    // Placeholder for future metrics/logging
  }

  @SubscribeMessage('game:join')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async joinGame(@MessageBody() payload: JoinGameDto) {
    const state = await this.gameService.recordJoin(payload);
    this.server.emit('lobby:update', state);
    return state;
  }
}
