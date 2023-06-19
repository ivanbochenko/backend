import { Elysia, t, ws } from "elysia"
import { PrismaClient } from '@prisma/client'
import { jwt } from '@elysiajs/jwt'
import { queryRoute } from "./queries"
import { mutationRoute } from "./mutations"
import bcrypt from 'bcrypt'
import { sendEmail } from "./mail"

const client = new PrismaClient()

export const setdb = (app: Elysia) => app.decorate("db", client)

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )
  // .use(ws())
  // .ws('/ws', {
  //   // validate incoming message
  //   body: t.Object({
  //     message: t.String()
  //   }),
  //   message(ws, { message }) {
  //     ws.publish('chat_id', {
  //       message,
  //       time: Date.now()
  //     })
  //   }
  // })
  .use(setdb)
  .group('/login', app => app
    // .post('/', async ({jwt}) => jwt.sign({id: '1011'}))
    .post('/token',
      async ({jwt, body}) => {
        const payload = await jwt.verify(body.token)
        if (!payload) throw Error('Unauthorized')
        const { id } = payload
        const token = await jwt.sign({id})
        return { token, id }
      },
      {
        body: t.Object({
          token: t.String()
        })
      }
    )
    .post('/password',
      async ({ jwt, body: { email, password, pushToken }, db }) => {
        const user = await db.user.update({
          where: { email },
          data: { token: pushToken ?? '' }
        })
        const isCorrectPassword = bcrypt.compareSync(password, user?.password!)
        if (!user || !isCorrectPassword) {
          throw Error(user ? 'Wrong password' : 'No such user')
        }
        const id = user.id
        const token = jwt.sign({ id, email })
        return { token, id }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String(),
          pushToken: t.String(),
        })
      }
    )
    .post('/register',
      async ({body: { email, password, pushToken }, db, jwt }) => {
        if (!email || !password) {
          throw Error('Bad request data')
        }
        const userCount = await db.user.count({ where: { email } })
        if (userCount > 0) {
          throw Error('User already exists')
        }
        const user = await db.user.create({
          data: {
            email,
            token: pushToken ?? '',
            password: bcrypt.hashSync(password, 8)
          },
        })
        const id = user.id
        const token = jwt.sign({ id, email })
        return { token, id }
      },
      {
        body: t.Object({
          email: t.String(),
          password: t.String(),
          pushToken: t.String(),
        })
      }
    )
    .post('/restore',
      async ({ body: { email }, db }) => {
        const str = (Math.random() + 1).toString(36).substring(7)
        const password = bcrypt.hashSync(str, 8)
        const updatedUser = await db.user.update({
          where: { email },
          data: { password }
        })
        if (!updatedUser) {
          throw Error('User does not exist')
        }
        const subject = 'Woogie password reset'
        sendEmail(email, subject, {name: updatedUser?.name!, password })
        return { message: 'Check email' }
      },
      {
        body: t.Object({
          email: t.String()
        })
      }
    )
  )
  .derive(async ({ request: { headers }, jwt }) => {
    const auth = headers.get('Authorization') ?? undefined
    const payload = await jwt.verify(auth)
    if (!payload) throw Error('Unauthorized')
    return { id: payload.id }
  })
  .use(queryRoute)
  .use(mutationRoute)
  .listen(3000);

export type App = typeof app

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);