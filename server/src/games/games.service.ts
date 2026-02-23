import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Round } from '../models/round.model';
import { Score } from '../models/score.model';
import { User } from '../models/user.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GamesService {
  constructor(
    @InjectConnection()
    private sequelize: Sequelize,
    @InjectModel(Round)
    private roundModel: typeof Round,
    @InjectModel(Score)
    private scoreModel: typeof Score,
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  async getAllRounds(): Promise<Round[]> {
    return this.roundModel.findAll();
  }

  async getRoundByUuid(uuid: string): Promise<Round | null> {
    return this.roundModel.findByPk(uuid);
  }

  async getScoreByUserAndRound(userId: string, roundUuid: string): Promise<Score | null> {
    return this.scoreModel.findOne({
      where: {
        user: userId,
        round: roundUuid,
      },
    });
  }

  async getOrCreateScoreByUserAndRound(userId: string, roundUuid: string): Promise<Score> {

    const [scoreRecord] = await this.scoreModel.findOrCreate({
      where: {
        user: userId,
        round: roundUuid,
      },
      defaults: {
        user: userId,
        round: roundUuid,
        taps: 0,
      },
    });
    return scoreRecord;
  }

  async createRound(): Promise<Round> {
    const now = new Date();
    const cooldownDuration = parseInt(process.env.COOLDOWN_DURATION || '60') * 1000; // Convert to milliseconds
    const roundDuration = parseInt(process.env.ROUND_DURATION || '300') * 1000; // Convert to milliseconds

    const startDatetime = new Date(now.getTime() + cooldownDuration);
    const endDatetime = new Date(now.getTime() + cooldownDuration + roundDuration);

    const round = await this.roundModel.create({
      uuid: uuidv4(),
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      status: 'scheduled',
    });

    return round;
  }

  scoreFromTapsCount(taps: number) {
    return Math.floor(taps / 11) * 9 + taps;
  }

  isRoundActive(round: Round): boolean {
    const now = new Date();
    return now >= round.start_datetime && now <= round.end_datetime;
  }

  isRoundCooldown(round: Round): boolean {
    const now = new Date();
    return now < round.start_datetime;
  }

  async processTap(userId: string, roundUuid: string, role: string): Promise<{ score: number }> {
    const round = await this.roundModel.findByPk(roundUuid);
    if (!round) {
      throw new BadRequestException('Round not found');
    }
    if (!this.isRoundActive(round)) {
      throw new BadRequestException('Round is not active');
    }

    const existingScore = await this.scoreModel.findOne({
      where: { user: userId, round: roundUuid },
    });
    if (!existingScore) {
      throw new BadRequestException('Подключиться к раунду можно только во время обратного отсчёта (cooldown)');
    }

    const transaction = await this.sequelize.transaction();
    try {
      const scoreRecord = await this.scoreModel.findOne({
        where: { user: userId, round: roundUuid },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
      if (!scoreRecord) {
        await transaction.rollback();
        throw new BadRequestException('Score record not found');
      }
      if (role !== 'nikita') {
        await scoreRecord.increment('taps', { by: 1, transaction });
      }
      await transaction.commit();
      await scoreRecord.reload();
      const score = this.scoreFromTapsCount(scoreRecord.taps);
      return { score };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async getRoundSummary(roundUuid: string): Promise<{
    totalScore: number;
    bestPlayer: { username: string; score: number } | null;
  }> {
    // Получаем все счета для раунда с информацией о пользователях
    const scores = await this.scoreModel.findAll({
      where: {
        round: roundUuid,
      },
      include: [
        {
          model: this.userModel,
          as: 'userRef',
          attributes: ['login'],
        },
      ],
    });

    const pointsFor = (score: Score & { userRef: User }) =>
      score.userRef.login === 'Никита' ? 0 : this.scoreFromTapsCount(score.taps);

    const totalScore = scores.reduce((sum, score) => sum + pointsFor(score), 0);

    let bestPlayer: { username: string; score: number } | null = null;
    if (scores.length > 0) {
      const bestScore = scores.reduce((max, score) => {
        const scorePoints = pointsFor(score);
        const maxPoints = pointsFor(max);
        return scorePoints > maxPoints ? score : max;
      });
      const bestPoints = pointsFor(bestScore);
      if (bestPoints > 0) {
        bestPlayer = {
          username: bestScore.userRef.login,
          score: bestPoints,
        };
      }
    }

    return {
      totalScore,
      bestPlayer,
    };
  }

  isRoundFinished(round: Round): boolean {
    const now = new Date();
    return now >= round.end_datetime;
  }
}
