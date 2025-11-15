/**
 * Test entities for testing TypeORM D1 driver
 */
export declare class User {
    id: number;
    name: string;
    email: string;
    age?: number;
    active: boolean;
    posts: Post[];
    profile?: Profile;
    createdAt: Date;
    updatedAt: Date;
}
export declare class Post {
    id: number;
    title: string;
    content?: string;
    authorId: number;
    author: User;
    tags: Tag[];
    createdAt: Date;
}
export declare class Tag {
    id: number;
    name: string;
    posts: Post[];
}
export declare class Profile {
    id: number;
    bio: string;
    userId: number;
    user: User;
}
export declare class TestColumns {
    id: number;
    intCol: number;
    integerCol: number;
    bigintCol: number;
    textCol: string;
    varcharCol: string;
    realCol: number;
    floatCol: number;
    doubleCol: number;
    booleanCol: boolean;
    blobCol?: Buffer;
    dateCol?: Date;
    datetimeCol?: Date;
    timestampCol?: Date;
    nullableCol?: string;
    defaultCol: string;
}
export declare class TestConstraints {
    id: number;
    uniqueCol: string;
    notNullCol: string;
    defaultCol: number;
}
