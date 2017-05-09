module.exports = {
  getUserInfo(user) {
    return {
      username: user.get('username'),
      email: user.get('email'),
      createdAt: user.get('createdAt'),
      verified: user.get('verified'),
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
    return {
      version: version.get('version'),
      data: JSON.parse(version.get('data')),
      readme: version.get('readme'),
      createdAt: version.get('createdAt'),
      dist: {
        shasum: version.get('shasum'),
        url: `${req.isSecure() ? 'https' : 'http'}://${req.headers.host}/v1/package/${pkg.get('name')}/${version.get('version')}`,
      },
    };
  },

  getPackageInfo(pkg) {
    return pkg.get();
  },

  async getPackageAuthors(pkg) {
    const response = this.getPackageInfo(pkg);
    response.tags = {};
    response.authors = [];
    response.versions = {};

    for (const author of await pkg.getAuthors()) {
      response.authors.push(this.getUserInfo(author));
    }

    return response;
  },

  async getPackageTags(pkg) {
    const response = this.getPackageInfo(pkg);
    response.tags = {};
    response.authors = [];
    response.versions = {};

    for (const tag of await pkg.getTags()) {
      response.tags[tag.get('name')] = await tag.getVersion().get('version');
    }

    return response;
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
