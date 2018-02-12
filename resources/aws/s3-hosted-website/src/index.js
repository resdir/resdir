import main from './main';
import s3 from './s3';
import acm from './acm';
import cloudFront from './cloud-front';
import route53 from './route-53';

export default Resource => ({
  ...main(Resource),
  ...s3(Resource),
  ...acm(Resource),
  ...cloudFront(Resource),
  ...route53(Resource)
});
