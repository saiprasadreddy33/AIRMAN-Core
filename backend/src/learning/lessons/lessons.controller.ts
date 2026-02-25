import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LessonsService, QuizAnswerInput } from './lessons.service';

@Controller('lessons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':id')
  @Roles('admin', 'instructor', 'student')
  async getLesson(
    @Param('id') id: string,
    @Req() req: { user: { tenant_id: string } },
  ) {
    return this.lessonsService.getLesson(req.user.tenant_id, id);
  }

  @Post(':id/attempt')
  @Roles('student')
  async attemptQuiz(
    @Param('id') id: string,
    @Body() dto: { answers: QuizAnswerInput[] },
    @Req() req: { user: { tenant_id: string; user_id: string } },
  ) {
    return this.lessonsService.attemptQuiz(
      req.user.tenant_id,
      id,
      req.user.user_id, // student ID
      dto.answers,
    );
  }

  /**
   * Endpoint to sync offline quiz attempts
   * Handles duplicate detection and validation
   */
  @Post(':id/sync-attempt')
  @Roles('student')
  async syncOfflineAttempt(
    @Param('id') id: string,
    @Body() dto: { lessonId?: string; answers: QuizAnswerInput[]; clientId: string },
    @Req() req: { user: { tenant_id: string; user_id: string } },
  ) {
    return this.lessonsService.syncOfflineAttempt(
      req.user.tenant_id,
      dto.lessonId || id,
      req.user.user_id,
      dto.answers,
      dto.clientId,
    );
  }
}
