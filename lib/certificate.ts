import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface BaseDnsValidatedCertificateProps {
  readonly domainName: string;
  readonly hostedZone: IHostedZone;
}

export class BaseDnsValidatedCertificate extends DnsValidatedCertificate {
  constructor(
    scope: Construct,
    id: string,
    props: BaseDnsValidatedCertificateProps
  ) {
    const { domainName, hostedZone } = props;
    super(scope, id, {
      domainName,
      hostedZone,
      region: 'us-east-1',
      subjectAlternativeNames: [`*.${domainName}`],
    });
  }
}
