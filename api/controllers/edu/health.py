from flask import jsonify
from flask_restx import Resource

from . import api, edu_ns

api.add_namespace(edu_ns)


@edu_ns.route("/health")
class HealthCheckAPI(Resource):
    @edu_ns.doc("health_check", description="Health check endpoint for education API")
    def get(self):
        """Health check endpoint"""
        return jsonify({"status": "healthy", "service": "education-api", "version": "1.0"})
