const url = require('url');

module.exports = {
  getUserInfo(user) {
    return {
      username: user.get('username'),
      email: user.get('email'),
      createdAt: user.get('createdAt'),
    };
  },

  async getAdvUserInfo(user) {
    const response = this.getUserInfo(user);
    response.packages = [];

    for (const pkg of await user.getPackages()) {
      response.packages.push(pkg.get('name'));
    }

    return response;
  },

  getVersionInfo(req, pkg, version) {
    const dist = url.parse(`https://${req.headers.host}`);
    if (dist.port === '443') dist.protocol = 'https:';
    else dist.protocol = 'http:';
    dist.pathname = `/package/${pkg.get('name')}/${version.get('version')}`;

    return {
      version: version.get('version'),
      data: JSON.parse(version.get('data')),
      readme: version.get('readme'),
      createdAt: version.get('createdAt'),
      dist: {
        shasum: version.get('shasum'),
        url: url.format(dist),
      },
    };
  },

  getPackageInfo(pkg) {
    return pkg.get();
  },

  async getAdvPackageInfo(req, pkg) {
    const response = this.getPackageInfo(pkg);
    response.tags = {};
    response.authors = [];
    response.versions = {};

    for (const tag of await pkg.getTags()) {
      response.tags[tag.get('name')] = await tag.getVersion().get('version');
    }

    for (const author of await pkg.getAuthors()) {
      response.authors.push(this.getUserInfo(author));
    }

    for (const version of await pkg.getVersions()) {
      response.versions[version.get('version')] = this.getVersionInfo(req, pkg, version);
    }

    return response;
  },

  async getPackageVersionInfo(req, pkg, version) {
    const response = this.getPackageInfo(pkg);
    response.tags = {};
    response.authors = [];
    response.versions = {
      [version.get('version')]: this.getVersionInfo(req, pkg, version),
    };

    for (const tag of await pkg.getTags()) {
      response.tags[tag.get('name')] = await tag.getVersion().get('version');
    }

    for (const author of await pkg.getAuthors()) {
      response.authors.push(this.getUserInfo(author));
    }

    return response;
  },
};
