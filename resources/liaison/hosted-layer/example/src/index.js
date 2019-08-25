import {Model} from '@liaison/model';
import {Layer, expose} from '@liaison/layer';

// time curl -v -X GET http://localhost:6789

// time curl -v -X POST -H "Content-Type: application/json" -d '{"query": {"Clock=>": {"getTime=>result": true}}, "source": "frontend"}' http://localhost:6789

@expose()
export class Clock extends Model {
  @expose() static getTime() {
    return new Date();
  }
}

export default new Layer({Clock});
