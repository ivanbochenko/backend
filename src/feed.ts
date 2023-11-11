import { Elysia, t } from "elysia"
import { dateShiftHours, getDistance } from "./calc"
import { db } from "./dataBaseClient"

export const feedRoute = new Elysia()
  .post(
    '/feed',
    async ({ body }) => {
      const { id, max_distance, latitude, longitude } = body
      const blocked = (await db.user.findUnique({
        where: { id },
        select: { blocked: true }
      }))?.blocked
      const events = await db.event.findMany({
        where: {
          time: { gte: dateShiftHours(new Date(), -24) },
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
      type Feed = typeof events & {
        distance: number;
      }
      const feed: Feed = [] as unknown as Feed
      // Calculate distance to events,
      // Exclude far away, user's own, blocked, swiped and full events
      events.forEach( event => {
        const e = ({...event, distance: getDistance(latitude, longitude, event.latitude, event.longitude)})
        if (
          (e.distance <= max_distance) &&
          (e.author_id !== id) &&
          !e.author.blocked.includes(id) &&
          (!e.matches.some(m => m.user.id === id)) &&
          (e.matches.length < e.slots)
        ) feed.push(e)
      })
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