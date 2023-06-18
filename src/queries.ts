import { Elysia, t } from "elysia"
import { getDistance } from "./distance"
import { setup } from "."

export const queryRoute = (app: Elysia) => app
  .use(setup)
  .get(
    '/user/:id',
    async ({ params: { id }, db }) => db.user.findUnique({
      where: { id }
    })
  )
  .get(
    '/event/:id',
    async ({ params: { id }, db }) => db.event.findUnique({
      where: { id }
    })
  )
  .get(
    '/events/:id',
    async ({ params: { id }, db }) => db.event.findMany({
      where: { author_id: id },
      include: {
        User: true,
        Match: {
          where: { accepted: true },
          include: { User: true }
        }
      }
    })
  )
  .get(
    '/messages/:id',
    async ({ params: { id }, db }) => db.message.findMany({
      where: { event_id: id },
      orderBy: { time: 'asc' },
      include: { User: true }
    })
  )
  .get(
    '/reviews/:id',
    async ({ params: { id }, db }) => db.review.findMany({
      where: { user_id: id },
      orderBy: { time: 'asc' },
      include: { User_Review_author_idToUser: true }
    })
  )
  .get(
    '/last_event/:id',
    async ({ params: { id }, db }) => db.event.findFirst({
      where: {
        author_id: id,
        time: { gt: new Date(new Date().setHours(0,0,0,0)) }
      },
      include: {
        User: true,
        Match: {
          where: {
            accepted: false,
            dismissed: false
          },
          include:{
            User: true
          }
        },
      }
    })
  )
  .post(
    '/feed',
    async ({ body, db }) => {
      const { id, max_distance, latitude, longitude } = body
      const date = new Date()
      date.setHours(0,0,0,0)
      const blocked = (await db.user.findUnique({
        where: { id },
        select: { blocked: true }
      }))?.blocked
      const events = await db.event.findMany({
        where: {
          time: { gte: date },
          author_id: { notIn: blocked }
        },
        orderBy: { User: { rating: 'desc' } },
        include: {
          Match: {
            where: {
              OR: [
                { accepted: true, },
                { User: { id } },
              ],
            },
            include: { User: true }
          },
          User: true
        }
      })
      const feed = events
        // Calculate distance to events
        .map( e => ({...e, distance: getDistance(latitude, longitude, e.latitude, e.longitude)}))
        // Exclude far away, user's own, blocked, swiped and full events
        .filter( e => (
          (e.distance <= max_distance) &&
          (e?.author_id !== id) &&
          !e?.User.blocked.includes(id) &&
          (!e?.Match.some(m => m.User?.id === id)) &&
          (e.Match.length < e.slots)
        ))
      return feed
    },
    {
      body: t.Object({
        id: t.String(),
        max_distance: t.Number(),
        latitude: t.Number(),
        longitude: t.Number(),
      })
    }
  )