import { Elysia, t } from "elysia"
import { getDistance } from "./distance"
import { setdb } from "."

const HOURS_EVENT_LAST = 24
const bridge = () => new Date(new Date().getTime() - 3600000 * HOURS_EVENT_LAST)

export const queryRoute = (app: Elysia) => app
  .use(setdb)
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
        author: true,
        matches: {
          where: { accepted: true },
          include: { user: true }
        }
      }
    })
  )
  .get(
    '/messages/:id',
    async ({ params: { id }, db }) => db.message.findMany({
      where: { event_id: id },
      orderBy: { time: 'asc' },
      include: { author: true }
    })
  )
  .get(
    '/reviews/:id',
    async ({ params: { id }, db }) => db.review.findMany({
      where: { user_id: id },
      orderBy: { time: 'asc' },
      include: { author: true }
    })
  )
  .get(
    '/last_event/:id',
    async ({ params: { id }, db }) => db.event.findFirst({
      where: {
        author_id: id,
        time: { gt: bridge() }
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
  .post(
    '/feed',
    async ({ body, db }) => {
      const { id, max_distance, latitude, longitude } = body
      const blocked = (await db.user.findUnique({
        where: { id },
        select: { blocked: true }
      }))?.blocked
      const events = await db.event.findMany({
        where: {
          time: { gte: bridge() },
          author_id: { notIn: blocked }
        },
        orderBy: { author: { rating: 'desc' } },
        include: {
          matches: {
            where: {
              OR: [
                { accepted: true, },
                { user: { id } },
              ],
            },
            include: { user: true }
          },
          author: true
        }
      })
      const feed = events
        // Calculate distance to events
        .map( e => ({...e, distance: getDistance(latitude, longitude, e.latitude, e.longitude)}))
        // Exclude far away, user's own, blocked, swiped and full events
        .filter( e => (
          (e.distance <= max_distance) &&
          (e?.author_id !== id) &&
          !e?.author.blocked.includes(id) &&
          (!e?.matches.some(m => m.user?.id === id)) &&
          (e.matches.length < e.slots)
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