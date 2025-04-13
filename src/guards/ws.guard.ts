import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PinoLogger } from 'nestjs-pino';
import { verify } from 'jsonwebtoken';

@Injectable()
export class WsGuard implements CanActivate {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(WsGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {

    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('Unauthorized');
      }

      const payload = verify(token, process.env.CLERK_JWT_PUBLIC_KEY, {
        algorithms: ['RS256'], // Specify the RS256 algorithm
      });

      // const payload = verifyToken(token, {
      //   audience: process.env.CLERK_JWT_KEY,
      //   authorizedParties: ['http://localhost:3000', 'ngrok http --url=valid-immensely-colt.ngrok-free.app'] //dev
      // });

      // const verifiedToken = await verifyToken(token, {
      //   jwtKey: process.env.CLERK_JWT_KEY,
      //   authorizedParties: ['http://localhost:3001', 'api.example.com'], // Replace with your authorized parties
      // })
      if (!payload) {
        throw new WsException('Unauthorized');
      }

      client.data.user = payload;

      return true;
    } catch (err) {
      this.logger.info(err);
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth =
      client.handshake.auth?.token || client.handshake.headers?.authorization;

    if (!auth) {
      return undefined;
    }

    return auth.replace('Bearer ', '');
  }
}

// import Cookies from 'cookies'
// import jwt from 'jsonwebtoken'

// export default async function (req: Request, res: Response) {
//   // Your public key should be set as an environment variable
//   const publicKey = process.env.CLERK_PEM_PUBLIC_KEY
//   // Retrieve session token from either `__session` cookie for a same-origin request
//   // or from the `Authorization` header for cross-origin requests
//   const cookies = new Cookies(req, res)
//   const tokenSameOrigin = cookies.get('__session')
//   const tokenCrossOrigin = req.headers.authorization

//   if (!tokenSameOrigin && !tokenCrossOrigin) {
//     res.status(401).json({ error: 'Not signed in' })
//     return
//   }

//   try {
//     let decoded
//     const options = { algorithms: ['RS256'] } // The algorithm used to sign the token. Optional.
//     const permittedOrigins = ['http://localhost:3000', 'https://example.com'] // Replace with your permitted origins

//     if (tokenSameOrigin) {
//       decoded = jwt.verify(tokenSameOrigin, publicKey, options)
//     } else {
//       decoded = jwt.verify(tokenCrossOrigin, publicKey, options)
//     }

//     // Validate the token's expiration (exp) and not before (nbf) claims
//     const currentTime = Math.floor(Date.now() / 1000)
//     if (decoded.exp < currentTime || decoded.nbf > currentTime) {
//       throw new Error('Token is expired or not yet valid')
//     }

//     // Validate the token's authorized party (azp) claim
//     if (decoded.azp && !permittedOrigins.includes(decoded.azp)) {
//       throw new Error("Invalid 'azp' claim")
//     }

//     res.status(200).json({ sessionToken: decoded })
//   } catch (error) {
//     res.status(400).json({
//       error: error.message,
//     })
//   }
// }
