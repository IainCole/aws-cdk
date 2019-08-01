import { Construct } from '@aws-cdk/core';
import { CfnAuthorizer, CfnAuthorizerProps } from './apigateway.generated';

/**
 * Represents an API Gateway authorizer.
 */
export interface IAuthorizer {
  /**
   * The authorizer ID.
   */
  readonly authorizerId: string;
}

/**
 * A Authorizer of a REST API.
 */
export class Authorizer extends CfnAuthorizer {
  constructor(scope: Construct, id: string, props: CfnAuthorizerProps) {
    super(scope, id, props);
  }

  /**
   * Required by IAuthorizer to get a reference to a custom authorizer function
   */
  get authorizerId(): string {
      return this.ref;
  }
}
