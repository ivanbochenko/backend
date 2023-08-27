import { Elysia, t } from "elysia"
import { jwt } from '@elysiajs/jwt'
import { sendEmail } from "./mail"
import { setdb } from "."

export const loginRoute = new Elysia()
  .use(setdb)
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )
  .group('/login', app => app
    // .post('/', async ({jwt}) => jwt.sign({id: '1011'}))
    .post('/token',
      async ({jwt, body}) => {
        const payload = await jwt.verify(body.token)
        if (!payload) throw Error('Unauthorized')
        const { id } = payload
        const newToken = await jwt.sign({id})
        return { token: newToken, id }
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
          data: { token: pushToken }
        })
        const isCorrectPassword = await Bun.password.verify(password, user?.password!)
        if (!user || !isCorrectPassword) {
          throw Error(user ? 'Wrong password' : 'No such user')
        }
        const id = user.id
        const token = await jwt.sign({ id })
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
        if (await db.user.count({ where: { email } }) > 0) {
          throw Error('User already exists')
        }
        const user = await db.user.create({
          data: {
            email,
            token: pushToken ?? '',
            password: await Bun.password.hash(password)
          },
        })
        return { token: await jwt.sign({ id: user.id }), id: user.id }
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
        const password = (Math.random() + 1).toString(36).substring(7)
        const hash = await Bun.password.hash(password)
        const updatedUser = await db.user.update({
          where: { email },
          data: { password: hash }
        })
        if (!updatedUser) {
          throw Error('User does not exist')
        }
        sendEmail(email, {name: updatedUser?.name!, password })
        return { message: 'Check email' }
      },
      {
        body: t.Object({
          email: t.String()
        })
      }
    )
  )