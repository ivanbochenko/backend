import { Elysia, t } from "elysia"
import { setdb } from "."
import { sendPushNotifications } from "./notifications"
import { dateShiftHours } from "./calc"

export const mutationRoute = (app: Elysia) => app
  .use(setdb)
  .post(
    '/event/create',
    async ({ body, db }) => {
      const shiftedTime = body.time >= dateShiftHours(new Date(), -0.5) ? body.time : dateShiftHours(body.time, 24)
      return await db.event.create({ data: {...body, time: shiftedTime} })
    },
    {
      body: t.Object({
        author_id: t.String(),
        photo: t.String(),
        title: t.String(),
        text: t.String(),
        slots: t.Number(),
        time: t.Date(),
        latitude: t.Number(),
        longitude: t.Number(),
      })
    }
  )
  .post(
    '/event/delete',
    async ({ body: { id }, db }) => db.event.delete({ where: { id } }),
    {
      body: t.Object({
        id: t.String()
      })
    }
  )
  .post(
    '/user/update',
    async ({ body, db }) => db.user.update({
      where: { id: body.id },
      data: body
    }),
    {
      body: t.Object({
        id: t.String(),
        name: t.String(),
        age: t.Number(),
        sex: t.String(),
        bio: t.String(),
        avatar: t.String(),
      })
    }
  )
  .post(
    '/user/block',
    async ({ body: { id, user_id }, db }) => db.user.update({
      where: { id },
      data: {
        blocked: {
          push: user_id,
        },
      },
    }),
    {
      body: t.Object({
        id: t.String(),
        user_id: t.String(),
      })
    }
  )
  .post(
    '/review',
    async ({ body, db }) => {
      const { text, stars, author_id, user_id } = body
      const prevReview = (await db.review.findMany({
        where: { user_id, author_id }
      }))[0]
      let review
      if (prevReview) {
        review = await db.review.update({
          where: { id: prevReview.id },
          data: { text, stars },
        })
      } else {
        review = await db.review.create({
          data: body
        })
      }
      const reviews = await db.review.findMany({
        where: { user_id }
      })

      const starsArr = reviews.map(r => r.stars)
      const sum = starsArr.reduce((a, b) => a + b, 0)
      const avg = Math.round(sum / starsArr.length) || 0
      const rating = Math.round((sum / starsArr.length) / 2.5 * starsArr.length)
      await db.user.update({
        where: { id: user_id },
        data: { stars: avg, rating }
      })
      return review
    },
    {
      body: t.Object({
        author_id: t.String(),
        user_id: t.String(),
        text: t.String(),
        stars: t.Number(),
      })
    }
  )
  .post(
    '/match/create',
    async ({ body: { user_id, event_id, dismissed }, db }) => {
      const match = await db.match.create({
        data: {
          user_id,
          event_id,
          dismissed
        },
        include: {
          user: true,
          event: {
            include: {
              author: true
            }
          }
        }
      })
      if (!dismissed) {
        await sendPushNotifications([match.event.author.token], {
          to: '',
          sound: 'default',
          title: 'You got a new match',
          body: match.user.name!,
        })
      }
      return match
    },
    {
      body: t.Object({
        user_id: t.String(),
        event_id: t.String(),
        dismissed: t.Boolean(),
      })
    }
  )
  .post(
    '/match/accept',
    async ({ body: { id }, db }) => {
      const match = await db.match.update({
        where: { id },
        data: { accepted: true },
        include: {
          user: true,
          event: true
        }
      })
      await sendPushNotifications([match.user.token], {
        to: '',
        sound: 'default',
        title: 'You matched to event',
        body: match.event.title,
      })
      return match
    },
    {
      body: t.Object({
        id: t.String(),
      })
    }
  )
  .post(
    '/match/delete',
    async ({ body, db }) => db.match.delete({ where: body }),
    {
      body: t.Object({
        id: t.String(),
      })
    }
  )

  {
    // postMessage: async (_, { text, author_id, event_id }, { pubSub, db } ) => {
    //   const message = await db.message.create({
    //     data: {
    //       text,
    //       author_id,
    //       event_id,
    //     },
    //     include: {
    //       author: true
    //     }
    //   })
    //   pubSub.publish('newMessages', message)
    //   const matches = await db.match.findMany({
    //     where: {
    //       event_id
    //     },
    //     include: {
    //       user: true,
    //     }
    //   })
    //   // Get tokens
    //   const tokens = matches.map((m) => m.user.token)
    //   // Include event author
    //   const event = await db.event.findUnique({
    //     where: { id: event_id },
    //     include: { author: true }
    //   })
    //   tokens.push(event!.author.token)
    //   // Exclude message author
    //   const index = tokens.indexOf(message.author.token)
    //   if (index > -1) {
    //     tokens.splice(index, 1)
    //   }
    //   // Notify users in chat
    //   if (tokens) {
    //     await sendPushNotifications(tokens, {
    //       to: '',
    //       sound: 'default',
    //       title: message.author.name!,
    //       body: text,
    //     })
    //   }
    //   return message
    // },
  }