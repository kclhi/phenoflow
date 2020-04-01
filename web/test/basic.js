let chai = require('chai');
let server = require('../app');
let should = chai.should();
let expect = chai.expect;

chai.use(require('chai-http'));

describe('basic', () => {

	describe('/GET homepage (reachable)', () => {

		it('Homepage should be reachable.', (done) => {

			chai.request(server)
				.get('/')
	            .end((err, res) => {

	            		res.should.have.status(200);
	            		res.body.should.be.a('object');
	            		done();

	            });

		});

	});

});
