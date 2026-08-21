<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoleHelp extends Model
{
    protected $table = 'role_help';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['role', 'summary'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
