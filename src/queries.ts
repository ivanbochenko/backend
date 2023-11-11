import { Elysia } from "elysia"
import { dateShiftHours } from "./calc"
import { db } from "./dataBaseClient"

export const queryRoute = new Elysia()
  .get(
    '/user/:id',
    async ({ params: { id } }) => db.user.findUnique({
      where: { id },
      include: {
        recievedReviews: true
      }
    })
  )
  .get(
    '/event/:id',
    async ({ params: { id } }) => db.event.findUnique({
      where: { id },
      include: {
        author: true,
        matches: {
          where: { accepted: true },
          include: { user: true }
        }
      }
    })
  )
  .get(
    '/events/:id',
    async ({ params: { id } }) => db.event.findMany({
      where: { author_id: id },
      include: {
        author: true,
        matches: {
          where: { accepted: true },
          include: { user: true }
        }
      }
    })
  )
  .get(
    '/matches/:id',
    async ({ params: { id } }) => db.match.findMany({
      where: {
        user_id: id,
        accepted: true
      },
      include: {
        event: true
      }
    })
  )
  .get(
    '/messages/:id',
    async ({ params: { id } }) => db.message.findMany({
      where: { event_id: id },
      orderBy: { time: 'asc' },
      include: { author: true }
    })
  )
  .get(
    '/reviews/:id',
    async ({ params: { id } }) => db.review.findMany({
      where: { user_id: id },
      orderBy: { time: 'asc' },
      include: { author: true }
    })
  )
  .get(
    '/last_event/:id',
    async ({ params: { id } }) => db.event.findFirst({
      where: {
        author_id: id,
        time: { gt: dateShiftHours(new Date(), -24) }
      },
      include: {
        author: true,
        matches: {
          where: {
            accepted: false,
            dismissed: false
          },
          include:{
            user: true
          }
        },
      }
    })
  )