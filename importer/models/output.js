'use strict';
module.exports = function(sequelize, DataTypes) {

	var output = sequelize.define('output', {doc:DataTypes.STRING, extension:DataTypes.STRING},{
		indexes: [
			{ unique: true, fields: [ 'stepId' ] } // ~MDC Eventually allow multiple outputs per step.
		]
	});

	output.associate = function(models) {
		output.belongsTo(models.step, {
			onDelete: "CASCADE",
			foreignKey: {
				allowNull: false
			}
		});
	};

	return output;

};
