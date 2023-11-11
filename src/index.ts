import { Elysia, t } from "elysia"
import { jwt } from '@elysiajs/jwt'
import { queryRoute } from "./queries"
import { mutationRoute } from "./mutations"
import { loginRoute } from "./login"
import { subscriptionRoute } from "./subscriptions";
import { photoRoute } from "./photo"
import { db } from "./dataBaseClient"
import { feedRoute } from "./feed"

const app = new Elysia()
  .get("/", () => "Hello 😜")
  .use(loginRoute)
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )
  .derive(async ({ request: { headers }, jwt }) => {
    const auth = headers.get('Authorization') ?? undefined
    const payload = await jwt.verify(auth)
    if (!payload) throw Error('Unauthorized')
    return { id: payload.id }
  })
  .post('/password/reset',
    async ({body: { password, newPassword }, id}) => {
      const hash = (await db.user.findUnique({ where: { id }, select: { password: true} }))?.password
      if (!hash) throw Error('No such user')
      const isCorrectPassword = await Bun.password.verify(password, hash)
      if (!isCorrectPassword) throw Error('Unauthorized')
      const newHash = await Bun.password.hash(newPassword)

      return await db.user.update({
        where: { id },
        data: { password: newHash }
      })
    },
    {
      body: t.Object({
        password: t.String(),
        newPassword: t.String()
      })
    }
  )
  .post('/password/user/delete',
    async ({body: { password }, id}) => {
      const hash = (await db.user.findUnique({ where: { id }, select: { password: true} }))?.password
      if (!hash) throw Error('No such user')
      if (!await Bun.password.verify(password, hash)) throw Error('Unauthorized')

      return await db.user.delete({ where: { id } })
    },
    {
      body: t.Object({
        password: t.String()
      })
    }
  )
  .use(photoRoute)
  .use(feedRoute)
  .use(queryRoute)
  .use(mutationRoute)
  .use(subscriptionRoute)
  .listen(3000)

export type App = typeof app

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);