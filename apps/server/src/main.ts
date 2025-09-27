import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const corsOptions = {
    origin: [
      /\.github\.dev$/,
      process.env.CLIENT_URL,
      process.env.API_URL,
    ].filter(Boolean),
    credentials: true,
  } as const;

  const app = await NestFactory.create(AppModule, { cors: corsOptions });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  const ioAdapter = new IoAdapter(app);
  const originalCreate = ioAdapter.createIOServer.bind(ioAdapter);
  ioAdapter.createIOServer = (port: number, options?: ServerOptions) =>
    originalCreate(port, {
      ...options,
      cors: {
        ...(options?.cors ?? {}),
        ...corsOptions,
      },
    });
  app.useWebSocketAdapter(ioAdapter);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
