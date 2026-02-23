import { Controller, Get, Post, Param, UseGuards, Req, ForbiddenException, Body, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GamesService } from './games.service';
import { 
  RoundsResponse, 
  RoundResponse, 
  RoundWithResultsResponse, 
  TapRequest, 
  TapResponse, 
  CreateRoundResponse,
  RoundWithScore,
  RoundWithResults 
} from '@roundsquares/contract';

@Controller()
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Get('rounds')
  @UseGuards(AuthGuard('jwt'))
  async getAllRounds(): Promise<RoundsResponse> {
    return this.gamesService.getAllRounds();
  }

  @Get('round/:uuid')
  @UseGuards(AuthGuard('jwt'))
  async getRound(@Param('uuid') uuid: string, @Req() req: any): Promise<RoundResponse | RoundWithResultsResponse> {
    const round = await this.gamesService.getRoundByUuid(uuid);
    if (!round) {
      return { error: 'Round not found' } as any;
    }

    const isCooldown = this.gamesService.isRoundCooldown(round);
    const isFinished = this.gamesService.isRoundFinished(round);

    // Подключиться к раунду можно только во время cooldown (успели зайти на страницу). В активной фазе новых участников не добавляем.
    let currentUserScore = 0;
    if (isCooldown) {
      const score = await this.gamesService.getOrCreateScoreByUserAndRound(req.user.sub, uuid);
      currentUserScore = this.gamesService.scoreFromTapsCount(score.taps);
    } else {
      const score = await this.gamesService.getScoreByUserAndRound(req.user.sub, uuid);
      if (score) currentUserScore = this.gamesService.scoreFromTapsCount(score.taps);
    }

    const baseResponse: RoundWithScore = {
      round,
      currentUserScore,
    };

    if (isFinished) {
      const summary = await this.gamesService.getRoundSummary(uuid);
      const responseWithResults: RoundWithResults = {
        ...baseResponse,
        totalScore: summary.totalScore,
        bestPlayer: summary.bestPlayer,
      };
      return responseWithResults;
    }

    return baseResponse;
  }

  @Post('tap')
  @UseGuards(AuthGuard('jwt'))
  async tap(@Body() body: TapRequest, @Req() req: { uuid: string, user: { sub: string, role: string } }): Promise<TapResponse> {
    if (!body.uuid) {
      throw new BadRequestException('UUID is required');
    }

    const result = await this.gamesService.processTap(req.user.sub, body.uuid, req.user.role);
    return { message: 'tap performed', score: result.score };
  }

  @Post('round')
  @UseGuards(AuthGuard('jwt'))
  async createRound(@Req() req: any): Promise<CreateRoundResponse> {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Only admin users can create rounds');
    }

    const round = await this.gamesService.createRound();
    return round;
  }
}
