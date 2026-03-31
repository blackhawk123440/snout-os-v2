import { NextRequest } from 'next/server';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

export function makeNextRequest(url: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(url, init);
}
