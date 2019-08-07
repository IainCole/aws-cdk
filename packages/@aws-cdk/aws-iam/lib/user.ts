import { Construct, Lazy, Resource, SecretValue } from '@aws-cdk/core';
import { IGroup } from './group';
import { CfnUser } from './iam.generated';
import { IIdentity } from './identity-base';
import { IManagedPolicy } from './managed-policy';
import { Policy } from './policy';
import { PolicyStatement } from './policy-statement';
import { ArnPrincipal, PrincipalPolicyFragment } from './principals';
import { IPrincipal } from './principals';
import { AttachedPolicies, undefinedIfEmpty } from './util';

export interface IUser extends IIdentity {
  readonly userName: string;
  addToGroup(group: IGroup): void;
}

export interface UserProps {
  /**
   * Groups to add this user to. You can also use `addToGroup` to add this
   * user to a group.
   *
   * @default - No groups.
   */
  readonly groups?: IGroup[];

  /**
   * A list managed policies associated with this role.
   *
   * You can add managed policies later using `attachManagedPolicy(policy)`.
   *
   * @default - No managed policies.
   */
  readonly managedPolicies?: IManagedPolicy[];

  /**
   * The path for the user name. For more information about paths, see IAM
   * Identifiers in the IAM User Guide.
   *
   * @default /
   */
  readonly path?: string;

  /**
   * A name for the IAM user. For valid values, see the UserName parameter for
   * the CreateUser action in the IAM API Reference. If you don't specify a
   * name, AWS CloudFormation generates a unique physical ID and uses that ID
   * for the user name.
   *
   * If you specify a name, you cannot perform updates that require
   * replacement of this resource. You can perform updates that require no or
   * some interruption. If you must replace the resource, specify a new name.
   *
   * If you specify a name, you must specify the CAPABILITY_NAMED_IAM value to
   * acknowledge your template's capabilities. For more information, see
   * Acknowledging IAM Resources in AWS CloudFormation Templates.
   *
   * @default Generated by CloudFormation (recommended)
   */
  readonly userName?: string;

  /**
   * The password for the user. This is required so the user can access the
   * AWS Management Console.
   *
   * You can use `SecretValue.plainText` to specify a password in plain text or
   * use `secretsmanager.Secret.fromSecretAttributes` to reference a secret in
   * Secrets Manager.
   *
   * @default User won't be able to access the management console without a password.
   */
  readonly password?: SecretValue;

  /**
   * Specifies whether the user is required to set a new password the next
   * time the user logs in to the AWS Management Console.
   *
   * If this is set to 'true', you must also specify "initialPassword".
   *
   * @default false
   */
  readonly passwordResetRequired?: boolean;
}

export class User extends Resource implements IIdentity {
  public readonly grantPrincipal: IPrincipal = this;
  public readonly assumeRoleAction: string = 'sts:AssumeRole';

  /**
   * An attribute that represents the user name.
   * @attribute
   */
  public readonly userName: string;

  /**
   * An attribute that represents the user's ARN.
   * @attribute
   */
  public readonly userArn: string;

  public readonly policyFragment: PrincipalPolicyFragment;

  private readonly groups = new Array<any>();
  private readonly managedPolicies = new Array<IManagedPolicy>();
  private readonly attachedPolicies = new AttachedPolicies();
  private defaultPolicy?: Policy;

  constructor(scope: Construct, id: string, props: UserProps = {}) {
    super(scope, id, {
      physicalName: props.userName,
    });

    this.managedPolicies.push(...props.managedPolicies || []);

    const user = new CfnUser(this, 'Resource', {
      userName: this.physicalName,
      groups: undefinedIfEmpty(() => this.groups),
      managedPolicyArns: Lazy.listValue({ produce: () => this.managedPolicies.map(p => p.managedPolicyArn) }, { omitEmpty: true }),
      path: props.path,
      loginProfile: this.parseLoginProfile(props)
    });

    this.userName = this.getResourceNameAttribute(user.ref);
    this.userArn = this.getResourceArnAttribute(user.attrArn, {
      region: '', // IAM is global in each partition
      service: 'iam',
      resource: 'user',
      resourceName: this.physicalName,
    });

    this.policyFragment = new ArnPrincipal(this.userArn).policyFragment;

    if (props.groups) {
      props.groups.forEach(g => this.addToGroup(g));
    }
  }

  /**
   * Adds this user to a group.
   */
  public addToGroup(group: IGroup) {
    this.groups.push(group.groupName);
  }

  /**
   * Attaches a managed policy to the user.
   * @param policy The managed policy to attach.
   */
  public addManagedPolicy(policy: IManagedPolicy) {
    if (this.managedPolicies.find(mp => mp === policy)) { return; }
    this.managedPolicies.push(policy);
    policy.attachToUser(this);
  }

  /**
   * Attaches a policy to this user.
   */
  public attachInlinePolicy(policy: Policy) {
    this.attachedPolicies.attach(policy);
    policy.attachToUser(this);
  }

  /**
   * Adds an IAM statement to the default policy.
   *
   * @returns true
   */
  public addToPolicy(statement: PolicyStatement): boolean {
    if (!this.defaultPolicy) {
      this.defaultPolicy = new Policy(this, 'DefaultPolicy');
      this.defaultPolicy.attachToUser(this);
    }

    this.defaultPolicy.addStatements(statement);
    return true;
  }

  private parseLoginProfile(props: UserProps): CfnUser.LoginProfileProperty | undefined {
    if (props.password) {
      return {
        password: props.password.toString(),
        passwordResetRequired: props.passwordResetRequired
      };
    }

    if (props.passwordResetRequired) {
      throw new Error('Cannot set "passwordResetRequired" without specifying "initialPassword"');
    }

    return undefined; // no console access
  }
}
