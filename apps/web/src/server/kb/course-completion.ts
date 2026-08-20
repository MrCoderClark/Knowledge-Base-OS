import { issueCertificate } from "./certificates";
import { getCourse } from "./courses";
import { completeEnrollmentIfDone } from "./enrollments";
import { createNotification } from "./notifications";
import { getCourseQuiz, hasPassedQuiz } from "./quizzes";

/**
 * Complete a learner's enrollment once every lesson is done AND — if the course
 * has an end-of-course quiz — they've passed it. Issues the certificate and a
 * notification on the transition. Idempotent; safe to call from both the
 * lesson-complete and quiz-submit paths. Returns true only on the transition.
 */
export async function finalizeCourseIfComplete(
  orgId: string,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const quiz = await getCourseQuiz(courseId);
  if (quiz && quiz.questions.length > 0) {
    const passed = await hasPassedQuiz(userId, quiz.id);
    if (!passed) return false; // gated on the quiz
  }

  const justFinished = await completeEnrollmentIfDone(courseId, userId);
  if (justFinished) {
    const course = await getCourse(orgId, courseId);
    const code = await issueCertificate(orgId, userId, courseId);
    await createNotification({
      orgId,
      userId,
      type: "course_completed",
      title: `Course complete: ${course?.title ?? "Course"}`,
      body: "You've finished every lesson — your certificate is ready. 🎉",
      linkUrl: `/verify/${code}`,
    });
  }
  return justFinished;
}
